#!/usr/bin/env node
// The guide benchmark, step 4: the printed set (scripts/bench/README.md).
//
//   node scripts/bench/print.mjs            writes DIR/print/marker-studio-test-pages.pdf (8 Letter pages), the sheets'
//                                           truth (DIR/cache/print/*.gz) and DIR/print/layout.json
//   --out DIR   (default: $BENCH_OUT, else <tmp>/marker-studio-bench; never inside the repo)
//
// Each sheet: a bench page (TUNE or HELD) inside four registration squares (5 mm, a 2 mm white hole, centres 10 mm in
// from the edges) and a 4-square page code along the bottom edge. Print at Actual size; photograph; then photos.mjs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TUNE, HELD } from './pages.mjs';
import { buildDesign, deriveSize, save } from './lib/build.mjs';
import { close as closeBrowser } from './lib/browser.mjs';
import { onPaper } from './lib/paper.mjs';
import { pdfOfImages } from './lib/pdf.mjs';

// the set: Ben's kind first (neurographic), then the common book kinds; two to colour in part by hand (marked)
export const PRINT = [
  { n: 1, id: 't01-neuro-margin', colourIn: true },
  { n: 2, id: 'h02-neuro-edge' },
  { n: 3, id: 't06-mandala', colourIn: true },
  { n: 4, id: 'h07-mandala-framed' },
  { n: 5, id: 't10-cartoon' },
  { n: 6, id: 'h09-botanical' },
  { n: 7, id: 't08-zentangle' },
  { n: 8, id: 'h11-tessellation' },
];

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
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
  const CACHE = path.join(OUT, 'cache'),
    PDIR = path.join(OUT, 'print');
  fs.mkdirSync(PDIR, { recursive: true });
  const pages = [],
    layout = [];
  for (const p of PRINT) {
    const spec = [...TUNE, ...HELD].find((s) => s.id === p.id),
      t0 = Date.now();
    const D = await buildDesign(spec, CACHE);
    const { D: D2, layout: L } = onPaper(D, p.n, {
      id: `p${p.n}-${spec.id}`,
      set: 'PRINT',
      style: spec.style,
      family: spec.family,
    });
    const prod = deriveSize(D2, 1200);
    save(path.join(CACHE, 'print', `p${p.n}.gz`), prod.meta, { input: prod.input, truth: prod.truth });
    pages.push({ w: D2.R.HW, h: D2.R.HH, grey: D2.R.dark });
    layout.push({
      ...L,
      page: spec.id,
      family: spec.family,
      colourIn: !!p.colourIn,
      nTruth: prod.meta.nTruth,
    });
    console.log(`page ${p.n}: ${spec.id}, truth ${prod.meta.nTruth} sections (${Date.now() - t0} ms)`);
  }
  await closeBrowser();
  const pdf = pdfOfImages(pages);
  fs.writeFileSync(path.join(PDIR, 'marker-studio-test-pages.pdf'), pdf);
  fs.writeFileSync(
    path.join(PDIR, 'layout.json'),
    JSON.stringify(
      {
        note: 'mm on a Letter sheet, origin top left; truth products in cache/print/p<n>.gz (1200 x 1553 = the whole sheet)',
        pages: layout,
      },
      null,
      1,
    ),
  );
  console.log(
    `wrote ${path.join(PDIR, 'marker-studio-test-pages.pdf')} (${(pdf.length / 1e6).toFixed(1)} MB)`,
  );
}
